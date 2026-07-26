import { prisma } from "@/lib/prisma";
import { summarizeServiceUsage, type ServiceUsage } from "@/lib/services/usage";

export async function getServiceUsage(serviceId: string): Promise<ServiceUsage> {
  const [orderServices, checklistTemplates, orderMaterialLines] = await Promise.all([
    prisma.orderService.count({ where: { serviceId } }),
    prisma.checklistTemplate.count({ where: { serviceId } }),
    prisma.orderMaterialLine.count({ where: { sourceServiceId: serviceId } }),
  ]);

  return summarizeServiceUsage({
    orderServices,
    checklistTemplates,
    orderMaterialLines,
  });
}
