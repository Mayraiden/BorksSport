import React, { useState } from 'react';
import { Button } from '@strapi/design-system';

interface ClearProductsButtonProps {
  onComplete?: () => void;
}

declare global {
  interface Window {
    strapi?: {
      notification?: {
        success: (message: string) => void;
        error: (message: string) => void;
        warning: (message: string) => void;
      };
    };
  }
}

export const ClearProductsButton: React.FC<ClearProductsButtonProps> = ({ onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    // Используем встроенную систему уведомлений Strapi через window
    if (window.strapi?.notification) {
      window.strapi.notification[type](message);
    } else {
      // Fallback на alert
      alert(message);
    }
  };

  const handleClear = async () => {
    if (!confirm('⚠️ ВНИМАНИЕ! Вы уверены, что хотите удалить ВСЕ товары из базы данных? Это действие необратимо!')) {
      return;
    }

    // Двойное подтверждение для безопасности
    if (!confirm('Это действие удалит ВСЕ товары. Вы действительно уверены?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/products/clear-all', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showNotification(
          `Успешно удалено ${data.data?.deletedCount || 0} товаров`,
          'success'
        );
        if (onComplete) {
          onComplete();
        }
      } else {
        throw new Error(data.error || data.message || 'Ошибка очистки');
      }
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : 'Ошибка при очистке товаров',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="danger"
      onClick={handleClear}
      disabled={isLoading}
      loading={isLoading}
    >
      {isLoading ? 'Удаление...' : '🗑️ Очистить коллекцию'}
    </Button>
  );
};

