/**
 * Ambient module declaration for `write-file-atomic@7.0.1`.
 *
 * The package ships as plain CommonJS (`main: "./lib/index.js"`) with no
 * bundled `.d.ts` files and no published `@types/write-file-atomic`
 * package, so `tsc --noEmit` fails with TS7016 ("Could not find a
 * declaration file for module 'write-file-atomic'") under this project's
 * `strict: true` config without this file. Typed narrowly to the surface
 * this project actually calls (01-RESEARCH.md § Decision: Atomic-Write
 * Mechanics): the default export function with an options object carrying
 * `fsync`/`encoding`, plus the `.sync` variant the library also exports.
 */
declare module 'write-file-atomic' {
  export interface WriteFileAtomicOptions {
    fsync?: boolean;
    encoding?: string | null;
    mode?: number;
    chown?: { uid: number; gid: number };
    tmpfileCreated?: (tmpfile: string) => void;
  }

  function writeFileAtomic(
    filename: string,
    data: string | Buffer,
    options?: WriteFileAtomicOptions | string,
  ): Promise<void>;

  namespace writeFileAtomic {
    function sync(
      filename: string,
      data: string | Buffer,
      options?: WriteFileAtomicOptions | string,
    ): void;
  }

  export default writeFileAtomic;
}
