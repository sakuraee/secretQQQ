export class CreateProcessDto {
  command: string;
  args?: string[];
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    shell?: boolean;
    [key: string]: any;
  };
}
