const mock = jest.fn().mockImplementation(() => ({
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  paymentIntents: {
    create: jest.fn(),
  },
}));

export default mock;
