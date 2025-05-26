import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import debounce from 'lodash.debounce';

export default function KLineChart({
  product,
  timeScale,
  isReal,
  klineData = []
}) {
  const chartRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!chartRef.current || !klineData.length) return;

    let chart;
    try {
      chart = echarts.init(chartRef.current);
    } catch (err) {
      console.error('Failed to initialize chart:', err);
      return;
    }

    const dates = klineData.map(item => new Date(item.timestamp));
    const timeRange = dates.length > 0 
      ? `${dates[0].toLocaleString()} - ${dates[dates.length - 1].toLocaleString()}`
      : '';

    const allValues = klineData.flatMap(item => [item.open, item.close, item.low, item.high]);
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const _padding = (maxVal - minVal) * 0.1;

    const option = {
      title: {
        // text: `${product} ${timeScale || ''} K线图 (${isReal ? '实盘' : '模拟'})`,
        subtext: `数据时间范围: ${timeRange}`,
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      xAxis: {
        type: 'category',
        data: dates.map(d => d.toLocaleString()),
        axisPointer: {
          snap: true
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
        boundaryGap: [0.1, 0.1]
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        },
        {
          start: 0,
          end: 100
        }
      ],
      toolbox: {
        feature: {
          dataZoom: {
            yAxisIndex: 'none'
          },
          restore: {},
          saveAsImage: {}
        }
      },
      series: [{
        type: 'candlestick',
        data: klineData.map(item => [
          item.open,
          item.close,
          item.low,
          item.high
        ]),
        itemStyle: {
          color: '#ef232a',
          color0: '#14b143',
          borderColor: '#ef232a',
          borderColor0: '#14b143'
        }
      }]
    };

    chart.setOption(option);

    const handleDataZoom = debounce(function () {
      setIsLoading(true);
      const option = chart.getOption();
      const startValue = option.dataZoom[0].startValue;
      const endValue = option.dataZoom[0].endValue;

      const visibleData = klineData.slice(startValue, endValue + 1);
      const visibleValues = visibleData.flatMap(item => [item.open, item.close, item.low, item.high]);
      const visibleMin = Math.min(...visibleValues);
      const visibleMax = Math.max(...visibleValues);
      const visiblePadding = (visibleMax - visibleMin) * 0.1;

      chart.setOption({
        yAxis: {
          min: visibleMin - visiblePadding,
          max: visibleMax + visiblePadding
        }
      }, { silent: true });

      setIsLoading(false);
    }, 300);

    chart.on('dataZoom', handleDataZoom);

    return () => chart.dispose();
  }, [klineData, product, isReal, timeScale]);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          backgroundColor: 'rgba(255,255,255,0.8)',
          padding: '10px 20px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          加载中...
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height: '500px' }} />
    </div>
  );
}
