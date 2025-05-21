const request = require('supertest');
const app = require('../src/index');

describe('Questions API', () => {
  let cookie;
  let testId;

  beforeAll(async () => {
    // Log in and get a session cookie
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testuser@example.com', password: 'testpassword' });
    expect(res.statusCode).toBe(200);
    cookie = res.headers['set-cookie'];

    // Create a test to attach questions to
    const testRes = await request(app)
      .post('/api/tests')
      .set('Cookie', cookie)
      .send({ name: 'Test for Questions', instructions: 'Do stuff', time_limit: 30 });
    expect(testRes.statusCode).toBe(201);
    testId = testRes.body.id;
  });

  it('should create a new multiple choice question', async () => {
    const res = await request(app)
      .post('/api/questions/mc')
      .set('Cookie', cookie)
      .send({
        test_id: testId,
        question_text: 'What is 2+2?',
        points: 1,
        options: [
          { is_correct: false },
          { is_correct: true }
        ]
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  it('should create a new freeform question', async () => {
    const res = await request(app)
      .post('/api/questions/freeform')
      .set('Cookie', cookie)
      .send({
        test_id: testId,
        question_text: 'Explain closures.',
        points: 2
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id');
  });
}); 