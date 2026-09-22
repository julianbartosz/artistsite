export type OrderCelebrationItem = {
  title: string;
  imageUrl: string;
  quantity: number;
};

export type OrderCelebration = {
  orderId: string;
  orderNumber: string;
  total: number;
  currency: string;
  createdAt: string;
  items: OrderCelebrationItem[];
};
