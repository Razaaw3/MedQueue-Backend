import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './src/config/db.config.js';
import authRoutes from './src/routes/auth.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import userRoutes from './src/routes/user.routes.js';
import tokenRoutes from './src/routes/tokens.routes.js';
import clinicRoutes from './src/routes/clinic.routes.js';
import {Server} from 'socket.io';
import http from 'http';
import cors from 'cors';

dotenv.config();

const app = express();

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

connectDB(io);

app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/clinics', clinicRoutes);

const PORT = process.env.PORT || 3000;

// Only start the server if not in a Vercel environment
if (process.env.VERCEL !== '1') {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default server;
