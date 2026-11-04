import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { createReadStream, ReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MIME_BY_EXT } from './utils/image-type.util';

@Injectable()
export class PhotoStorageService implements OnModuleInit {
  private readonly logger = new Logger(PhotoStorageService.name);
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = path.resolve(process.cwd(), config.getOrThrow<string>('UPLOAD_DIR'));
  }

  async onModuleInit() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  /** Nama file di-generate ulang (UUID). Nama dari klien tidak dipakai. Mengembalikan nama file. */
  async save(buffer: Buffer, ext: string): Promise<string> {
    const filename = `${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(this.dir, filename), buffer, { flag: 'wx', mode: 0o640 });
    return filename;
  }

  async remove(filename: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.dir, path.basename(filename)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Gagal menghapus ${filename}: ${(e as Error).message}`);
      }
    }
  }

  async open(photoPath: string): Promise<{ stream: ReadStream; mime: string; size: number }> {
    const filename = path.basename(photoPath); // cegah path traversal
    const mime = MIME_BY_EXT[path.extname(filename).slice(1).toLowerCase()];
    const full = path.join(this.dir, filename);
    if (!mime || !full.startsWith(this.dir + path.sep)) {
      throw new NotFoundException('Photo file not found');
    }
    try {
      const stat = await fs.stat(full);
      return { stream: createReadStream(full), mime, size: stat.size };
    } catch {
      throw new NotFoundException('Photo file not found');
    }
  }
}

