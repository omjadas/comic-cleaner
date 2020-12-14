#!/usr/bin/env node

import { promises as fs } from "fs";
import glob, { Glob, IGlob } from "glob";
import Seven from "node-7z";
import path from "path";
import util from "util";
import yargs from "yargs";

const globPromise = util.promisify(glob);

function myGlob(pattern: string, options: glob.IOptions, cb: (e: Error | null, v: [string[], IGlob]) => any) {
    const match = new Glob(pattern, options, (err, matches) => {
        cb(err, [matches, match]);
    });
}

const myGlobPromise = util.promisify(myGlob);

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
        for (const file of argv.files) {
            const dir = file + ".tmp";

            const extractStream = Seven.extractFull(
                file,
                dir,
                {
                    recursive: true,
                }
            );

            extractStream.on("end", async () => {
                if (argv.exclude.length) {
                    let [prevFiles, prevMatch] = await myGlobPromise(argv.exclude[0], {
                        cwd: dir,
                        root: dir,
                        absolute: true,
                    });

                    prevFiles.forEach(f => fs.unlink(f));

                    for (const e of argv.exclude.slice(1)) {
                        [prevFiles, prevMatch] = await myGlobPromise(e, {
                            cwd: dir,
                            root: dir,
                            absolute: true,
                            cache: prevMatch.cache,
                            statCache: prevMatch.statCache,
                        });

                        prevFiles.forEach(f => fs.unlink(f));
                    }
                }

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
                        argv.delete ? fs.rm(file) : Promise.resolve(),
                        fs.rm(dir, {
                            recursive: true,
                            force: true,
                        }),
                    ]);
                });
            });
        }
    })
    .completion()
    .argv;
