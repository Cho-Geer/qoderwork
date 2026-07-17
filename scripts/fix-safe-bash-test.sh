#!/bin/bash
# Fix the failing safe-bash-core test for Phase 9
cd /home/zhaoge/workspace/opencode/work-one

# Use sed to replace the failing test
python3 -c "
import re

filepath = '.opencode/lib/__tests__/safe-bash-core.test.ts'
with open(filepath, 'r') as f:
    content = f.read()

old_test = '''    it('should have Orchestrator extensions for node (from opencode.json)', () => {
      const result = getAgentShellAllowlist('@Orchestrator');
      // @Orchestrator opencode.json safe_shell includes node *.js *
      expect(result.allowed).toContain('node *.js *');
    });'''

new_test = '''    it('should have node *.js * in Orchestrator deny list (Phase 9: write via node removed)', () => {
      const result = getAgentShellAllowlist('@Orchestrator');
      // Phase 9 step 9.1: node -e/node *.ts/node *.js moved from allow to deny
      expect(result.denied).toContain('node *.js *');
      expect(result.denied).toContain('node -e *');
      expect(result.denied).toContain('node *.ts *');
      // Read-only commands remain allowed
      expect(result.allowed).toContain('cat *');
      expect(result.allowed).toContain('ls *');
    });'''

content = content.replace(old_test, new_test)

with open(filepath, 'w') as f:
    f.write(content)

print('Test updated successfully')
"
