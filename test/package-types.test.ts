import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const consumer = fileURLToPath(new URL('./types/consumer.mts', import.meta.url));

for (const [name, module, moduleResolution] of [
  ['bundler', ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
  ['node16', ts.ModuleKind.Node16, ts.ModuleResolutionKind.Node16],
  ['nodenext', ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
] as const) {
  test(`published types preserve inference under ${name}`, () => {
    const program = ts.createProgram([consumer], {
      module,
      moduleResolution,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    );

    expect(diagnostics).toEqual([]);
  });
}
