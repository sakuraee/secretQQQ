export class CreateProcessDto {
  command: string;
  args?: string[];
  id?: string;
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    shell?: boolean;
    [key: string]: any;
  };
}
