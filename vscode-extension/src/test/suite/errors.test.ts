import * as assert from 'assert';
import { 
    JulesBridgeError, 
    ValidationError, 
    ApiError, 
    GitError, 
    ConfigurationError, 
    ProjectNotInitializedError, 
    SecurityError, 
    TimeoutError 
} from '../../utils/errors';

suite('Errors Test Suite', () => {
    
    test('JulesBridgeError inheritance', () => {
        const err = new JulesBridgeError('test message');
        assert.ok(err instanceof Error);
        assert.ok(err instanceof JulesBridgeError);
        assert.strictEqual(err.message, 'test message');
        assert.strictEqual(err.name, 'JulesBridgeError');
        assert.ok(err.stack);
    });

    test('ValidationError properties', () => {
        const err = new ValidationError('invalid field', 'apiKey', 'abc');
        assert.ok(err instanceof JulesBridgeError);
        assert.strictEqual(err.name, 'ValidationError');
        assert.strictEqual(err.field, 'apiKey');
        assert.strictEqual(err.value, 'abc');
    });

    test('ApiError properties', () => {
        const err = new ApiError('api failed', 500, 'Internal Server Error');
        assert.ok(err instanceof JulesBridgeError);
        assert.strictEqual(err.statusCode, 500);
        assert.strictEqual(err.originalError, 'Internal Server Error');
    });

    test('GitError properties', () => {
        const err = new GitError('git failed', 'push', 'rejected');
        assert.ok(err instanceof JulesBridgeError);
        assert.strictEqual(err.operation, 'push');
        assert.strictEqual(err.originalError, 'rejected');
    });

    test('ConfigurationError properties', () => {
        const err = new ConfigurationError('config missing', 'jules.apiKey');
        assert.ok(err instanceof JulesBridgeError);
        assert.strictEqual(err.configKey, 'jules.apiKey');
    });

    test('ProjectNotInitializedError properties', () => {
        const err = new ProjectNotInitializedError('tazztone', 'jules-studio');
        assert.ok(err instanceof JulesBridgeError);
        assert.strictEqual(err.owner, 'tazztone');
        assert.strictEqual(err.repo, 'jules-studio');
        assert.ok(err.message.includes('tazztone/jules-studio'));
    });

    test('SecurityError properties', () => {
        const err = new SecurityError('violation', 'path_traversal');
        assert.ok(err instanceof JulesBridgeError);
        assert.strictEqual(err.violationType, 'path_traversal');
    });

    test('TimeoutError properties', () => {
        const err = new TimeoutError('slow', 5000);
        assert.ok(err instanceof JulesBridgeError);
        assert.strictEqual(err.timeoutMs, 5000);
        
        const defaultErr = new TimeoutError();
        assert.strictEqual(defaultErr.message, 'Operation timed out');
    });
});
