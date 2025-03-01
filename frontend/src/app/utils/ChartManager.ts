import {
    ColorType,
    createChart as createLightWeightChart,
    CrosshairMode,
    ISeriesApi,
    UTCTimestamp,
  } from "lightweight-charts";
  
  export class ChartManager {
    private candleSeries: ISeriesApi<"Candlestick">;
    private lastUpdateTime: number = 0;
    private chart: any;
    private currentBar: {
      open: number | null;
      high: number | null;
      low: number | null;
      close: number | null;
    } = {
      open: null,
      high: null,
      low: null,
      close: null,
    };
  
    constructor(
      ref: any,
      initialData: any[],
      layout: { background: string; color: string }
    ) {
      const chart = createLightWeightChart(ref, {
        autoSize: true,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
      

          //@ts-ignore
          tickMarkFormatter: (unixTimeInSeconds, tickMarkType, locale) => {
            const date = new Date(unixTimeInSeconds * 1000);
          
            // Example: "2 Mar, 14:05" (24-hour time, no AM/PM)
            return date.toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false, // 24-hour clock
            });
          },
          
        },
        localization: {
          // This affects the crosshair tooltip (and can also affect the axis if no tickMarkFormatter is set)
          timeFormatter: (unixTimeInSeconds: any) => {
            const date = new Date(unixTimeInSeconds * 1000);
            // Example format: "02/03/2025, 14:05:00"
            return date.toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            });
          },
        },
        overlayPriceScales: {
          ticksVisible: true,
          borderVisible: true,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          visible: true,
          ticksVisible: true,
          entireTextOnly: true,
        },
        grid: {
          horzLines: {
            visible: false,
          },
          vertLines: {
            visible: false,
          },
        },
        layout: {
          background: {
            type: ColorType.Solid,
            color: layout.background,
          },
          textColor: "white",
        },
      });

      this.chart = chart;
      this.candleSeries = chart.addCandlestickSeries();
  
      this.candleSeries.setData(
        initialData.map((data) => ({
          ...data,
          time: (data.timestamp / 1000) as UTCTimestamp,
        }))
      );
    }
    public update(updatedPrice: any) {
      if (!this.lastUpdateTime) {
        this.lastUpdateTime = new Date().getTime();
      }
      console.log(" update ~ this.lastUpdateTime:", this.lastUpdateTime)

      this.candleSeries.update({
        time: (this.lastUpdateTime / 1000) as UTCTimestamp,
        close: updatedPrice.close,
        low: updatedPrice.low,
        high: updatedPrice.high,
        open: updatedPrice.open,
      });
  
      if (updatedPrice.newCandleInitiated) {
        this.lastUpdateTime = updatedPrice.time;
      }
    }
    public destroy() {
      this.chart.remove();
    }
  }
  