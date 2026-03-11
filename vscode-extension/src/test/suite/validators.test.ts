import * as assert from 'assert';
import * as path from 'path';
import { 
    validateGitHubIdentifier, 
    validateBranchName, 
    validatePrompt, 
    validateApiKey, 
    validateSessionResponse, 
    validatePathInBrainDirectory, 
    validateUrl 
} from '../../utils/validators';
import { ValidationError, SecurityError } from '../../utils/errors';

suite('Validators Test Suite', () => {
    
    test('validateGitHubIdentifier', () => {
        // Valid cases
        assert.doesNotThrow(() => validateGitHubIdentifier('google', 'owner'));
        assert.doesNotThrow(() => validateGitHubIdentifier('jules-studio', 'repo'));
        assert.doesNotThrow(() => validateGitHubIdentifier('test_repo.v1', 'repo'));

        // Invalid cases
        assert.throws(() => validateGitHubIdentifier('', 'owner'), ValidationError);
        assert.throws(() => validateGitHubIdentifier('   ', 'owner'), ValidationError);
        assert.throws(() => validateGitHubIdentifier('a'.repeat(101), 'repo'), ValidationError);
        
        // Security cases (path traversal)
        assert.throws(() => validateGitHubIdentifier('../etc/passwd', 'repo'), SecurityError);
        assert.throws(() => validateGitHubIdentifier('owner/repo', 'repo'), SecurityError);
        assert.throws(() => validateGitHubIdentifier('..', 'owner'), SecurityError);

        // Invalid characters
        assert.throws(() => validateGitHubIdentifier('repo!', 'repo'), ValidationError);
        assert.throws(() => validateGitHubIdentifier('repo$', 'repo'), ValidationError);
    });

    test('validateBranchName', () => {
        // Valid cases
        assert.doesNotThrow(() => validateBranchName('main'));
        assert.doesNotThrow(() => validateBranchName('feature/auth-implementation'));
        assert.doesNotThrow(() => validateBranchName('fix_issue_123'));

        // Invalid cases
        assert.throws(() => validateBranchName(''), ValidationError);
        assert.throws(() => validateBranchName('a'.repeat(256)), ValidationError);
        
        // Git invalid chars
        assert.throws(() => validateBranchName('branch with spaces'), ValidationError);
        assert.throws(() => validateBranchName('branch~name'), ValidationError);
        assert.throws(() => validateBranchName('branch^name'), ValidationError);
        assert.throws(() => validateBranchName('branch:name'), ValidationError);
        
        // Start/End rules
        assert.throws(() => validateBranchName('.start-with-dot'), ValidationError);
        assert.throws(() => validateBranchName('/start-with-slash'), ValidationError);
        assert.throws(() => validateBranchName('ends-with.lock'), ValidationError);
    });

    test('validatePrompt', () => {
        // Valid
        assert.doesNotThrow(() => validatePrompt('Refactor this code'));
        assert.doesNotThrow(() => validatePrompt('Fix the bug in auth.ts'));

        // Invalid
        assert.throws(() => validatePrompt(''), ValidationError);
        assert.throws(() => validatePrompt('   '), ValidationError);
        assert.throws(() => validatePrompt('a'.repeat(50001)), ValidationError);
    });

    test('validateApiKey', () => {
        // Valid (20-500 chars)
        assert.doesNotThrow(() => validateApiKey('AIzaSy' + 'x'.repeat(20)));

        // Too short
        assert.throws(() => validateApiKey('short-key'), ValidationError);
        
        // Control characters
        assert.throws(() => validateApiKey('key\nwith\nnewlines'), ValidationError);
    });

    test('validateSessionResponse', () => {
        // Valid
        assert.doesNotThrow(() => validateSessionResponse({ id: 'abc-123_xyz', name: 'sessions/123' }));

        // Missing fields
        assert.throws(() => validateSessionResponse({ name: 'test' }), ValidationError);
        assert.throws(() => validateSessionResponse({ id: 'abc' }), ValidationError);
        
        // Malformed ID
        assert.throws(() => validateSessionResponse({ id: 'short', name: 'test' }), ValidationError);
        assert.throws(() => validateSessionResponse({ id: 'invalid!char', name: 'test' }), ValidationError);
    });

    test('validatePathInBrainDirectory', () => {
        const brainDir = path.sep === '/' ? '/home/user/.gemini/antigravity/brain' : 'C:\\Users\\user\\.gemini\\antigravity\\brain';
        
        // Valid
        const validPath = path.join(brainDir, 'session-123', 'task.md');
        assert.doesNotThrow(() => validatePathInBrainDirectory(validPath, brainDir));
        assert.doesNotThrow(() => validatePathInBrainDirectory(brainDir, brainDir));

        // Outside (Sibling)
        const siblingDir = path.sep === '/' ? '/home/user/.gemini/antigravity/brain2' : 'C:\\Users\\user\\.gemini\\antigravity\\brain2';
        assert.throws(() => validatePathInBrainDirectory(siblingDir, brainDir), SecurityError);

        // Outside (Parent/System)
        const systemPath = path.sep === '/' ? '/etc/passwd' : 'C:\\Windows\\System32\\config';
        assert.throws(() => validatePathInBrainDirectory(systemPath, brainDir), SecurityError);
    });

    test('validateUrl', () => {
        const allowed = ['jules.google.com', 'googleapis.com'];

        // Valid
        assert.doesNotThrow(() => validateUrl('https://jules.google.com/session/1', allowed));
        assert.doesNotThrow(() => validateUrl('https://jules.googleapis.com/v1/sessions', allowed));

        // Untrusted domain
        assert.throws(() => validateUrl('https://malicious.com', allowed), SecurityError);

        // Dangerous protocol
        assert.throws(() => validateUrl('javascript:alert(1)', allowed), SecurityError);
        assert.throws(() => validateUrl('data:text/html,<html>', allowed), SecurityError);
        assert.throws(() => validateUrl('file:///etc/passwd', allowed), SecurityError);

        // Non-HTTP
        assert.throws(() => validateUrl('ftp://jules.google.com', allowed), ValidationError);
    });
});
