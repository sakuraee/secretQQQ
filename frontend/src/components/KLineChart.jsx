import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import axios from 'axios';

export default function KLineChart({ product, isReal, trades = [], initialAmount = 10000 }) {
  const chartRef = useRef(null);
  const [timeRange, setTimeRange] = useState('');

  useEffect(() => {
    const chart = echarts.init(chartRef.current);
    
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:3000/kline', {
          params: { product, isReal }
        });
        
        const klineData = response.data;
        const dates = klineData.map(item => new Date(item.time));
        
        // 设置时间范围
        if (dates.length > 0) {
          setTimeRange(`${dates[0].toLocaleString()} - ${dates[dates.length - 1].toLocaleString()}`);
        }

        // 计算收益
        let balance = initialAmount;
        const profitData = [];
        const tradeMarkers = [];
        
        trades.forEach(trade => {
          const [time, action] = trade;
          const tradeTime = new Date(time);
          const klineIndex = dates.findIndex(d => d >= tradeTime);
          
          if (klineIndex !== -1) {
            const kline = klineData[klineIndex];
            const price = action === 'buy' ? kline.open : kline.close;
            
            // 简单计算：每次交易10%的资金
            const amount = balance * 0.1;
            if (action === 'buy') {
              balance -= amount;
              balance += amount / price * kline.close;
            } else {
              balance += amount * price;
            }
            
            tradeMarkers.push({
              xAxis: klineIndex,
              yAxis: price,
              symbol: action === 'buy' ? 'triangle' : 'circle',
              symbolSize: 10,
              itemStyle: {
                color: action === 'buy' ? '#00ff00' : '#ff0000'
              }
            });
          }
          
          profitData.push(balance);
        });

        const option = {
          title: {
            text: `数据时间范围: ${timeRange}`,
            left: 'center'
          },
          grid: [
            { top: 60, height: '60%' }, // K线图
            { top: '70%', height: '20%' } // 收益曲线
          ],
          xAxis: [
            {
              type: 'category',
              data: dates.map(d => d.toLocaleString()),
              gridIndex: 0
            },
            {
              type: 'category',
              data: dates.map(d => d.toLocaleString()),
              gridIndex: 1
            }
          ],
          yAxis: [
            { type: 'value', gridIndex: 0 },
            { type: 'value', gridIndex: 1 }
          ],
          series: [
            {
              type: 'candlestick',
              data: klineData.map(item => [
                item.open,
                item.close,
                item.low,
                item.high
              ]),
              markPoint: {
                data: tradeMarkers
              },
              gridIndex: 0
            },
            {
              type: 'line',
              data: profitData,
              smooth: true,
              areaStyle: {},
              gridIndex: 1
            }
          ]
        };
        
        chart.setOption(option);
      } catch (error) {
        console.error('Error fetching kline data:', error);
      }
    };

    fetchData();
    
    return () => chart.dispose();
  }, [product, isReal, trades, initialAmount]);

  return (
    <div style={{ width: '100%' }}>
      <div ref={chartRef} style={{ width: '100%', height: '500px' }} />
    </div>
  );
}
