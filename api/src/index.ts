import express from 'express';
import cors from 'cors';
import orderRoutes from './routes/orderRoutes'
import tickerRoutes from './routes/tickerRoutes'
import tradeRoutes from "./routes/tradeRoutes"; 
import klineRoutes from "./routes/klineRoutes"; 



const app = express();

app.use(cors({
    origin: '*',  // Allows requests from any origin, change '*' to specific domains for security
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization']  // Allowed headers
  }));

app.use(express.json());

const PORT = process.env.PORT || 4000;

app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/ticker', tickerRoutes);
app.use("/api/v1/trades", tradeRoutes);
app.use("/api/v1/klines", klineRoutes);



app.listen(PORT, ()=> {
    console.log(`listening on port ${PORT}`)
});