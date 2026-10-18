export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export const notFound = () => new HttpError(404, 'Not found');
