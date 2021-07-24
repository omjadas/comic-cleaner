#!/usr/bin/env node

import { SingleBar } from "cli-progress";
import { promises as fs } from "fs";
import glob from "glob";
import Seven from "node-7z";
import path from "path";
import restoreCursor from "restore-cursor";
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
        restoreCursor();

        const singleBar = new SingleBar({
            hideCursor: true,
            stopOnComplete: true,
        });

        singleBar.start(argv.files.length, 0);

        argv.files.forEach(file => {
            const dir = file + ".tmp.d";
            const newFile = file.split('.').slice(0, -1).join('.') + ".cbz";
            const tmpFile = newFile + ".tmp";

            const extractStream = Seven.extractFull(
                file,
                dir,
                {
                    recursive: true,
                }
            );

            extractStream.on("error", () => {
                console.error(`\nFailed to open ${file}`);
                singleBar.increment();
            });

            extractStream.on("end", async () => {
                if (!extractStream.info.has("Can't open as archive")) {
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
                        tmpFile,
                        dir + "/*",
                        {
                            archiveType: "zip",
                            recursive: true,
                        }
                    );

                    addStream.on("end", () => {
                        Promise.all([
                            argv.delete ? fs.unlink(file) : Promise.resolve(),
                            fs.rename(tmpFile, newFile),
                            fs.rm(dir, {
                                recursive: true,
                                force: true,
                            }),
                        ])
                            .then(() => {
                                singleBar.increment();
                            });
                    });
                }
            });
        });
    })
    .completion()
    .argv;
