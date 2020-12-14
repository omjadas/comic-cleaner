#!/usr/bin/env node

import { promises as fs } from "fs";
import glob from "glob";
import Seven from "node-7z";
import path from "path";
import util from "util";
import yargs from "yargs";

const globPromise = util.promisify(glob);

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
                type: "boolean",
                alias: "d",
                default: false,
            })
            .option("exclude", {
                type: "string",
                array: true,
                alias: "e",
                default: [] as string[],
            });
    }, argv => {
        argv.files.forEach(file => {
            const dir = file + ".tmp";

            const extractStream = Seven.extractFull(
                file,
                dir,
                {
                    recursive: true,
                }
            );

            extractStream.on("end", async () => {
                await Promise.all(argv.exclude.map(e => {
                    return globPromise(e, {
                        cwd: dir,
                        root: dir,
                        absolute: true,
                    })
                        .then(files => {
                            return Promise.all(
                                files.map(f => fs.unlink(f))
                            );
                        });
                }));

                const addStream = Seven.add(
                    file.split('.').slice(0, -1).join('.') + ".cbz",
                    dir + "/*",
                    {
                        archiveType: "zip",
                        recursive: true,
                    }
                );

                addStream.on("end", async () => {
                    await Promise.all([
                        argv.delete ? fs.unlink(file) : Promise.resolve(),
                        fs.rmdir(dir, {
                            recursive: true,
                        }),
                    ]);
                });
            });
        });
    })
    .completion()
    .argv;
