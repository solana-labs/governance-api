import mercurius from "mercurius";

export class Exception extends mercurius.ErrorWithProps {
  constructor(error?: unknown) {
    super("Internal server error", {
      message: error instanceof Error ? error.message : String(error),
      extensions: error,
    }, 500)
  }
}

export class MalformedData extends mercurius.ErrorWithProps {
  constructor() {
    super("Malformed data", {}, 400);
  }
}

export class MalformedRequest extends mercurius.ErrorWithProps {
  constructor(message?: string) {
    super(message || "Malformed request", {}, 400);
  }
}

export class NotFound extends mercurius.ErrorWithProps {
  constructor() {
    super("Not found", {}, 404);
  }
}

export class NotUnique extends mercurius.ErrorWithProps {
  constructor(field?: string) {
    super(field ? `"${field}" must be unique` : 'Not unique', { field }, 422);
  }
}

export class RateLimit extends mercurius.ErrorWithProps {
  constructor(action?: string) {
    super("You've hit the rate limit", { action }, 409);
  }
}

export class Unauthorized extends mercurius.ErrorWithProps {
  constructor() {
    super("You are not authorized to perform that action", {}, 403)
  }
}

export class Unsupported extends mercurius.ErrorWithProps {
  constructor() {
    super("That operation is unsupported", {}, 501);
  }
}

export class UnsupportedDevnet extends mercurius.ErrorWithProps {
  constructor() {
    super("Devnet is not currently supported", {}, 501);
  }
}
