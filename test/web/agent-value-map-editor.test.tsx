import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AgentValueMapEditor } from '../../web/src/components/specialized/AgentValueMapEditor';

describe('AgentValueMapEditor', () => {
  it('preserves unsupported keys and only offers unused supported agents', () => {
    render(<AgentValueMapEditor descriptor={{ path: 'effort.agent_overrides', editor: 'agent-map', editable: true, sensitive: false, sourceEvidence: [], allowedValues: ['low', 'high'] }} value={{ 'gsd-planner': 'low', 'future-agent': 'custom' }} onChange={() => undefined} />);
    expect(screen.getByText('Unsupported value preserved: custom')).toBeInTheDocument();
    const select = screen.getByLabelText('Add supported agent');
    fireEvent.change(select, { target: { value: 'gsd-executor' } });
    expect(screen.getByText('gsd-planner')).toBeInTheDocument();
  });
});
