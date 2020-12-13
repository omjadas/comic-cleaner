#!/usr/bin/env node

import { promises as fs } from "fs";
import Seven from "node-7z";
import path from "path";
import yargs from "yargs";

yargs
    .command("$0 <files..>", "clean a comic file", yargs => {
        return yargs
            .positional("files", {
                type: "string",
                array: true,
                demandOption: "true",
                coerce: (files: string[]) => {
                    return files.map(file => {
                        return path.join(process.cwd(), file);
                    });
                },
            })
            .option("delete", {
                type: "string",
                array: true,
                alias: "d",
            });
    }, argv => {
        argv.files.forEach(file => {
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
                        argv.delete ? fs.rm(file) : Promise.resolve(),
                        fs.rm(file + ".tmp", {
                            recursive: true,
                            force: true,
                        }),
                    ]);
                });
            });
        });
    })
    .completion()
    .argv;
