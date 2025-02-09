function Ask({ price, size, total, maxTotal }: { price: string, size: string, total: number, maxTotal: number }) {
    console.log(price,size,total,maxTotal);
    // Calculate width percentage for the background based on max total
    const widthPercentage = (total / maxTotal) * 100;

    return (
        <div className="relative flex justify-between text-sm gap-2 mb-1">
            <div className="text-red-500 z-10">
                {parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-slate-300 z-10">
                {parseFloat(size).toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
            </div>
            <div className="text-slate-300 z-10">
                {total.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
            </div>
            {/* Background bar for total volume */}
            <div 
                className="absolute top-0 right-0 h-full bg-red-900 opacity-50" 
                style={{ width: `${widthPercentage}%` }}
            />
            <div 
                className="absolute top-0 right-0 h-full bg-red-700 opacity-30" 
                style={{ width: `${widthPercentage * 0.8}%` }}
            />
        </div>
    );
}


export default function AsksTable({ asks }: { asks: [string, string][] }) {
    let currentTotal = 0;
    let relevantAsks = asks.slice(0, 15);

    let asksWithTotal: [string, string, number][] = relevantAsks.map(ask => {
        currentTotal += Number(ask[1]);
        return [ask[0], ask[1], parseFloat(currentTotal.toFixed(2))];
    });

    // Find the max total for scaling bars
    const maxTotal = Math.max(...asksWithTotal.map((ask) => ask[2]));

    asksWithTotal = asksWithTotal.reverse();  // Reverse to match the UI

    return (
        <div className="p-2 text-white bg-customGray">
            {asksWithTotal.map((ask, index) => (
                <Ask price={ask[0]} size={ask[1]} total={ask[2]} maxTotal={maxTotal} key={index} />
            ))}
        </div>
    );
}
