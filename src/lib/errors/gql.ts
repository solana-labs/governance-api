import mercurius from "mercurius";

export class MalformedData extends mercurius.ErrorWithProps {
  constructor() {
    super("Malformed data", {}, 400);
  }
}

export class Unauthorized extends mercurius.ErrorWithProps {
  constructor() {
    super("You are not authorized to perform that action", {}, 403)
  }
}
