// __mocks__/prisma-client.ts
const prisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  booking: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  slot: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  bay: {
    findUnique: jest.fn(),
  },
};

export default prisma;
