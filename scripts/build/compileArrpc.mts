import { execSync } from "child_process";
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(import.meta.dir, "../../resources/arrpc");
const ARRPC_DIR = join(import.meta.dir, "../../node_modules/arrpc-bun");
const ARRPC_ENTRY = join(ARRPC_DIR, "src/index.ts");

interface CompileTarget {
	platform: string;
	arch: string;
	target: string;
	output: string;
}

const TARGETS: CompileTarget[] = [
	{
		platform: "linux",
		arch: "x64",
		target: "bun-linux-x64",
		output: "arrpc-linux-x64"
	},
	{
		platform: "linux",
		arch: "arm64",
		target: "bun-linux-arm64",
		output: "arrpc-linux-arm64"
	},
	{
		platform: "darwin",
		arch: "x64",
		target: "bun-darwin-x64",
		output: "arrpc-darwin-x64"
	},
	{
		platform: "darwin",
		arch: "arm64",
		target: "bun-darwin-arm64",
		output: "arrpc-darwin-arm64"
	},
	{
		platform: "windows",
		arch: "x64",
		target: "bun-windows-x64",
		output: "arrpc-windows-x64.exe"
	}
];

if (!existsSync(ARRPC_DIR)) {
	console.error("Error: arrpc-bun not found in node_modules");
	console.error("Run 'bun install' first");
	process.exit(1);
}

if (!existsSync(ARRPC_ENTRY)) {
	console.error(`Error: arrpc-bun entry point not found at ${ARRPC_ENTRY}`);
	process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

console.log("Compiling arRPC binaries for all platforms...");
console.log(`Source: ${ARRPC_ENTRY}`);
console.log(`Output: ${OUTPUT_DIR}\n`);

for (const target of TARGETS) {
	const outputPath = join(OUTPUT_DIR, target.output);

	console.log(`Compiling ${target.platform}-${target.arch}...`);
	console.log(`  Target: ${target.target}`);
	console.log(`  Output: ${outputPath}`);

	try {
		const cmd = `bun build ${ARRPC_ENTRY} --compile --target=${target.target} --outfile=${outputPath}`;
		execSync(cmd, {
			stdio: "inherit",
			cwd: ARRPC_DIR
		});

		console.log(`Compiled ${target.output}\n`);
	} catch (err) {
		console.error(`Failed to compile ${target.output}`);
		console.error(err);
		process.exit(1);
	}
}

console.log("Copying detectable database files...");
const detectableJson = join(ARRPC_DIR, "detectable.json");
const detectableFixesJson = join(ARRPC_DIR, "detectable_fixes.json");

const detectableJsonDest = join(OUTPUT_DIR, "detectable.json");
const detectableFixesJsonDest = join(OUTPUT_DIR, "detectable_fixes.json");

if (existsSync(detectableJsonDest)) {
	unlinkSync(detectableJsonDest);
}

if (existsSync(detectableFixesJsonDest)) {
	unlinkSync(detectableFixesJsonDest);
}

if (existsSync(detectableJson)) {
	const content = readFileSync(detectableJson);
	writeFileSync(detectableJsonDest, content);
	console.log("Copied detectable.json");
}

if (existsSync(detectableFixesJson)) {
	const content = readFileSync(detectableFixesJson);
	writeFileSync(detectableFixesJsonDest, content);
	console.log("Copied detectable_fixes.json");
}

console.log("\nAll arRPC binaries compiled successfully!");
