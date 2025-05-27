import { parentPort, workerData } from 'worker_threads';

// 示例worker处理逻辑
function processTask(data: any) {
  // 这里实现具体的耗时任务处理
  return { result: `Processed ${data}` };
}

// 监听主线程消息
if (parentPort) {
  parentPort.on('message', (data) => {
    const result = processTask(data);
    parentPort?.postMessage(result);
  });
}
