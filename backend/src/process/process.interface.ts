export interface ProcessInfo {
  id: string;
  child: import('child_process').ChildProcess;
  command: string;
  args: string[];
  logs: string[];
  status: 'running' | 'exited' | 'terminated';
  startTime: Date;
}
