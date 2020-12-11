#!/usr/bin/env node

import Seven from "node-7z";
import path from "path";
import { promises as fs } from "fs";

async function main() {
    const file = path.join(process.cwd(), process.argv[2]);

    const extractStream = Seven.extractFull(
        file,
        file + ".tmp",
        {
            recursive: true,
        }
    );

    extractStream.on("end", async () => {

        const addStream = Seven.add(
            file.split('.').slice(0, -1).join('.') + ".cbz",
            file + ".tmp/*",
            {
                archiveType: "zip",
                recursive: true,
            }
        );

        addStream.on("end", async () => {
            await Promise.all([
                fs.rm(file),
                fs.rm(file + ".tmp", {
                    recursive: true,
                    force: true,
                }),
            ]);
        });
    });
}

main();
