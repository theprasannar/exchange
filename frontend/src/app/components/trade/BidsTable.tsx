function Bid({ price, size, total, maxTotal }: { price: string, size: string, total: number, maxTotal: number }) {
    // Calculate width percentage for the background based on max total
    const widthPercentage = (total / maxTotal) * 100;

    return (
        <div className="relative flex justify-between text-sm gap-2 mb-1">
            <div className="text-green-500 z-10">
                {parseFloat(price).toFixed(2)}
            </div>
            <div className="text-slate-300 z-10">
                {parseFloat(size).toFixed(5)}
            </div>
            <div className="text-slate-300 z-10">
                {total.toFixed(5)}
            </div>
            {/* Background bar for total volume */}
            <div 
                className="absolute top-0 right-0 h-full bg-green-900 opacity-50" 
                style={{ width: `${widthPercentage}%` }}
            />
            <div 
                className="absolute top-0 right-0 h-full bg-green-700 opacity-30" 
                style={{ width: `${widthPercentage * 0.8}%` }}
            />
        </div>
    );
}


export default function BidsTable({ bids }: { bids: [string, string][] }) {
    let currentTotal = 0;
    let relevantBids = bids.slice(0, 15);

    let bidsWithTotal: [string, string, number][] = relevantBids.map(bid => {
        currentTotal += Number(bid[1]);
        return [bid[0], bid[1], parseFloat(currentTotal.toFixed(2))];
    });

    // Find the max total for scaling bars
    const maxTotal = Math.max(...bidsWithTotal.map((bid) => bid[2]));

    return (
        <div className="p-2 text-white bg-customGray">
            {bidsWithTotal.map((bid, index) => (
                <Bid price={bid[0]} size={bid[1]} total={bid[2]} maxTotal={maxTotal} key={index} />
            ))}
        </div>
    );
}
