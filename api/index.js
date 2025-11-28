import app from './server.js';

// Handler para Vercel Serverless Functions
export default async function handler(req, res) {
  return app(req, res);
}
