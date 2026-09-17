/**
 * Legacy Prisma placeholder.
 *
 * The User Accounts module (module 1) was rebuilt on the portable SQL layer in
 * `src/db`. The other modules still in this repo (match, chat, status, payment,
 * admin) were written against the old Prisma client and have not been migrated
 * yet. Their controllers import this file; instead of crashing the server at
 * boot (or worse, returning a 500 with a stack trace) every call resolves to a
 * clear HTTP 501 so the frontend can show "coming soon".
 *
 * When a module is migrated, delete its usage of this file.
 */
import { ApiError } from "../utils/apiError.js";

function modelProxy(modelName) {
  return new Proxy(
    {},
    {
      get(_target, operation) {
        return () => {
          throw new ApiError(
            501,
            `The "${modelName}" module is not migrated yet (prisma.${modelName}.${String(operation)}).`,
            { code: "MODULE_NOT_MIGRATED" }
          );
        };
      },
    }
  );
}

const prisma = new Proxy(
  {},
  {
    get(_target, modelName) {
      return modelProxy(String(modelName));
    },
  }
);

export default prisma;
