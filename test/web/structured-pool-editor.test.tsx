import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StructuredPoolEditor } from '../../web/src/components/specialized/StructuredPoolEditor';

describe('StructuredPoolEditor', () => {
  it('renders descriptor fields and required status', () => {
    render(<StructuredPoolEditor descriptor={{ path: 'ship.pr_body_sections', editor: 'structured-array', editable: true, sensitive: false, sourceEvidence: [], fields: [{ path: 'heading', type: 'string', required: true }] }} value={{ heading: '' }} onChange={() => undefined} />);
    expect(screen.getByLabelText('heading')).toBeInTheDocument();
    expect(screen.getByText('heading is required.')).toBeInTheDocument();
  });
});
