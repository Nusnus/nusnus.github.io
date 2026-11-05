/**
 * @file The URL class, which ECMAScript's own library leaves to each runtime,
 * and every runtime the contract runs in, Node, workerd and the browser, has
 * from the WHATWG URL Standard: https://url.spec.whatwg.org/#url-class. The
 * contract loads no runtime's types, so its code cannot log, wait or do I/O;
 * it declares this class alone, which does none of those, with only its
 * constructor and its serialization. Each package that imports the contract
 * types the class by its own runtime's declaration instead.
 */

/** A URL parsed as the WHATWG URL Standard parses it. */
declare class URL {
  readonly href: string;
  constructor(url: string, base?: string | URL);
}
