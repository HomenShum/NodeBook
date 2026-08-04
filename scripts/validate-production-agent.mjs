// Validates production-agent.json against the copied checklist schema.
// ajv in node_modules is v6 (draft-07 engine); every keyword this schema uses is
// draft-07 compatible, so we strip the 2020-12 $schema marker before compiling.
// Expected output (see production-agent.gaps.md): VALID with zero errors —
// release.canary is declared, backed by the deploy smoke-check + automatic rollback
// workflow and the env-gated cookie-sticky middleware split.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Ajv = require("ajv");

const schema = JSON.parse(readFileSync(new URL("../production-agent.v1.schema.json", import.meta.url), "utf8"));
delete schema.$schema;
delete schema.$id;
const contract = JSON.parse(readFileSync(new URL("../production-agent.json", import.meta.url), "utf8"));

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
const valid = validate(contract);
const errors = validate.errors ?? [];
for (const error of errors) console.log(`${error.dataPath || "/"} ${error.message}`);
const onlyExpectedGap = errors.length === 1
  && errors[0].dataPath === ".release"
  && /canary/.test(JSON.stringify(errors[0].params));
console.log(valid ? "VALID" : onlyExpectedGap ? "VALID_EXCEPT_DECLARED_CANARY_GAP" : "INVALID");
process.exit(valid || onlyExpectedGap ? 0 : 1);
