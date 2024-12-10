import express from 'express';
import orderRoutes from './routes/orderRoutes'

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;


app.use('/api/v1/orders', orderRoutes);






app.listen(PORT, ()=> {
    console.log(`listening on port ${PORT}`)
});