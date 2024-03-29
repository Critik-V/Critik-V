import { NextFunction, Request, Response } from 'express';
import { catchAsync, response, statusCodes } from '../utils';
import { Post } from '@prisma/client';
import { db } from '../config';
import fs from 'node:fs';
import { Panic } from '../errors';

export const getNewestPosts = catchAsync(
	async (req: Request, res: Response) => {
		enum JobType {
			INTERNSHIP = 'INTERNSHIP',
			APPRENTICESHIP = 'APPRENTICESHIP',
			FULLTIME = 'FULLTIME',
			PARTTIME = 'PARTTIME',
			FREELANCE = 'FREELANCE',
		}
		enum ExperienceLevel {
			ENTRY_LEVEL = 'ENTRY_LEVEL',
			JUNIOR = 'JUNIOR',
			MID = 'MID',
			SENIOR = 'SENIOR',
		}
		const {
			jobType,
			experienceLevel,
			search,
		}: { jobType: JobType; experienceLevel: ExperienceLevel; search: string } =
			req.query as {
				jobType: JobType;
				experienceLevel: ExperienceLevel;
				search: string;
			};
		const posts = await db.post.findMany({
			take: 10,
			orderBy: {
				createdAt: 'desc',
			},
			where: {
				title: {
					contains: search,
				},
				archived: false,
				jobType,
				experienceLevel,
			},
			include: {
				comments: true,
				favByUsers: true,
			},
		});
		response(res, statusCodes.OK, 'newest posts fetched successfully', posts);
	}
);

export const makePost = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		const { file } = req;
		if (!file)
			return next(new Panic('no file uploaded', statusCodes.BAD_REQUEST));
		const {
			title,
			description,
			jobType,
			experienceLevel,
			establishmentName,
			domain,
			authorId,
		}: Post = req.body;
		const newPost = await db.post.create({
			data: {
				title,
				description,
				jobType,
				experienceLevel,
				establishmentName,
				domain,
				authorId,
			},
		});

		const filename = `${newPost.id}.pdf`;
		const destinationDirectory = 'resumes/';

		if (!fs.existsSync(destinationDirectory)) {
			fs.mkdirSync(destinationDirectory);
		}

		if (file) {
			fs.writeFileSync(destinationDirectory + filename, file.buffer);
		}

		response(res, statusCodes.CREATED, 'post created succesfully', newPost);
	}
);

export const modifyPost = catchAsync(async (req: Request, res: Response) => {
	const { id }: { id: string } = req.params as { id: string };
	const {
		authorId,
		title,
		description,
		jobType,
		experienceLevel,
		establishmentName,
		domain,
	}: Post = req.body;
	const post = await db.post.update({
		where: {
			id: id,
			authorId: authorId,
		},
		data: {
			title,
			description,
			jobType,
			experienceLevel,
			establishmentName,
			domain,
		},
	});

	response(res, statusCodes.OK, 'post modified succesfully', post);
});

export const deletePost = catchAsync(async (req: Request, res: Response) => {
	const { id }: { id: string } = req.params as {
		id: string;
	};
	const { authorId }: Post = req.body;
	await db.post.delete({
		where: {
			id: id,
			authorId: authorId,
		},
	});
	res.status(statusCodes.OK).json({
		status: 'success',
		message: 'post deleted succesfully',
	});
});

export const archivePost = catchAsync(async (req: Request, res: Response) => {
	const { id }: { id: string } = req.params as { id: string };
	const { authorId }: Post = req.body;
	await db.post.update({
		where: {
			id,
			authorId,
		},
		data: {
			archived: true,
		},
	});
	res.status(statusCodes.OK).json({
		status: 'success',
		message: 'post archived succesfully',
	});
});

export const getMyPosts = catchAsync(async (req: Request, res: Response) => {
	const { authorId }: Post = req.body;
	const posts = await db.post.findMany({
		where: {
			authorId,
			archived: false,
		},
		include: {
			favByUsers: {
				select: {
					id: true,
				},
			},
		},
	});
	response(res, statusCodes.OK, 'my posts fetched succesfully', posts);
});

export const getOnePost = catchAsync(async (req: Request, res: Response) => {
	const { id }: { id: string } = req.params as { id: string };
	const post = await db.post.findFirst({
		where: {
			id: id,
			archived: false,
		},
		include: {
			comments: true,
			favByUsers: true,
		},
	});
	res.status(statusCodes.OK).json({
		status: 'success',
		message: 'post fetched succesfully',
		data: post,
	});
});

export const getArchivedPosts = catchAsync(
	async (req: Request, res: Response) => {
		const { authorId }: Post = req.body;
		const posts = await db.post.findMany({
			where: {
				authorId,
				archived: true,
			},
		});
		response(res, statusCodes.OK, 'archived posts fetched successfully', posts);
	}
);

export const getOneArchivedPost = catchAsync(
	async (req: Request, res: Response) => {
		const { id }: { id: string } = req.params as { id: string };
		const { authorId }: Post = req.body;
		const post = await db.post.findUnique({
			where: {
				id,
				authorId,
				archived: true,
			},
			include: {
				comments: true,
				favByUsers: true,
			},
		});
		res.status(statusCodes.OK).json({
			status: 'success',
			message: 'post archived fetched succesfully',
			data: post,
		});
	}
);

export const favPost = catchAsync(async (req: Request, res: Response) => {
	enum favPostAction {
		ADD = 'add',
		REMOVE = 'remove',
	}
	const { id }: Post = req.body;
	const { userId } = req.body as { userId: string };
	const { action } = req.query as { action: favPostAction };
	const updatedUser = await db.post.update({
		where: {
			id,
		},
		data:
			action === favPostAction.ADD
				? {
						favByUsers: { connect: { id: userId } },
						totalFav: { increment: 1 },
					}
				: action === favPostAction.REMOVE
					? {
							favByUsers: { disconnect: { id: userId } },
							totalFav: { decrement: 1 },
						}
					: {},
	});
	response(res, statusCodes.OK, 'resume saved succesfully', updatedUser);
});

export const getFavPosts = catchAsync(async (req: Request, res: Response) => {
	const { userId }: { userId: string } = req.body;
	const posts = await db.post.findMany({
		where: {
			favByUsers: {
				some: {
					id: userId,
				},
			},
		},
		include: {
			comments: true,
			favByUsers: true,
		},
	});
	response(res, statusCodes.OK, 'fav posts fetched succesfully', posts);
});
