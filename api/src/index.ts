import express from 'express';
import cors from 'cors';
import orderRoutes from './routes/orderRoutes'

const app = express();

app.use(cors({
    origin: '*',  // Allows requests from any origin, change '*' to specific domains for security
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization']  // Allowed headers
  }));

app.use(express.json());

const PORT = process.env.PORT || 4000;

app.use('/api/v1/orders', orderRoutes);

app.listen(PORT, ()=> {
    console.log(`listening on port ${PORT}`)
});