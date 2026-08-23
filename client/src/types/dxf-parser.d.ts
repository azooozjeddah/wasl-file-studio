declare module "dxf-parser" {
  export class DxfParser {
    parseSync(input: string): unknown;
  }
  export default function parse(input: string): unknown;
}
