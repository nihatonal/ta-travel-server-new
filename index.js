import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import adminRoutes from './routes/admin.js';
import reviewRoutes from './routes/reviews.js';
import newsletterRoutes from './routes/newsletter.js';
import formsRoutes from './routes/forms.js'
dotenv.config();
const app = express();
const PROJECT_URL = process.env.PROJECT_URL;
const allowedOrigins = ['http://localhost:3000', 'http://localhost:5000', "https://www.ta-travel.ru", PROJECT_URL];  // Allow only your frontend URL


app.use(cors({
  origin: allowedOrigins,  // Only allow requests from the allowed origins
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],  // You can add other HTTP methods if needed
}));
app.use(express.json());

// 1 yıl cache, immutable
app.use('/static', express.static('public', {
  maxAge: '1y',
  immutable: true
}));

app.use('/js', express.static('build/js', {
  maxAge: '1y',
  immutable: true
}));

app.use('/css', express.static('build/css', {
  maxAge: '1y',
  immutable: true
}));


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected')).catch(err => console.log(err));

// Statik dosyalar
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/forms', formsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
