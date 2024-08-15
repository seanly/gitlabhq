import { serialize, builders, source, text, serializeWithOptions } from '../../serialization_utils';

const { paragraph, link } = builders;

it('escapes < and > in a paragraph', () => {
  expect(
    serialize(paragraph(text("some prose: <this> and </this> looks like code, but isn't"))),
  ).toBe("some prose: \\<this\\> and \\</this\\> looks like code, but isn't");
});

it('correctly serializes a paragraph as markdown', () => {
  const sourceMarkdown = source('some prose', 'p');
  expect(serialize(paragraph(sourceMarkdown, 'some prose'))).toBe('some prose');

  expect(
    serializeWithOptions(
      { pristineDoc: paragraph(sourceMarkdown, 'some prose') },
      paragraph(sourceMarkdown, 'new content'),
    ),
  ).toBe('new content');
});

describe('when a paragraph contains a link', () => {
  const referenceDefinitions = '[1]: https://example.com';
  const paragraphSource = source('some prose with a reference [link][1]', 'p');
  const linkSource = source('[link][1]', 'a');

  const doc = paragraph(
    paragraphSource,
    text('some prose with a reference '),
    link({ href: 'https://example.com', ...linkSource }, 'link'),
  );

  describe('when the paragraph is unchanged', () => {
    it('correctly serializes paragraph with reference link definitions from source document', () => {
      expect(serializeWithOptions({ referenceDefinitions, pristineDoc: doc }, doc)).toBe(
        'some prose with a reference [link][1]\n\n[1]: https://example.com',
      );
    });
  });

  describe('when the paragraph is changed but link is unchanged', () => {
    it('correctly serializes paragraph with reference link definitions from source document', () => {
      expect(
        serializeWithOptions(
          { referenceDefinitions, pristineDoc: doc },
          paragraph(
            paragraphSource,
            text('some prose with a reference '),
            link({ href: 'https://example.com', ...linkSource }, 'link'),
            text(' changed'),
          ),
        ),
      ).toBe('some prose with a reference [link][1] changed\n\n[1]: https://example.com');
    });
  });

  describe('when both the paragraph and link are changed', () => {
    it('correctly serializes paragraph with reference link definitions from source document', () => {
      expect(
        serializeWithOptions(
          { referenceDefinitions, pristineDoc: doc },
          paragraph(
            paragraphSource,
            text('some prose with a reference '),
            link({ href: 'https://example.com', ...linkSource }, 'link changed'),
          ),
        ),
      ).toBe(
        'some prose with a reference [link changed](https://example.com)\n\n[1]: https://example.com',
      );
    });
  });
});
