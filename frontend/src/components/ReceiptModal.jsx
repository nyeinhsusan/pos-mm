import React, { useState, useEffect } from 'react';
import Receipt from './Receipt';
import api from '../services/api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const ReceiptModal = ({ isOpen, onClose, saleId }) => {
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch receipt data when modal opens
  useEffect(() => {
    if (isOpen && saleId) {
      fetchReceiptData();
    }
  }, [isOpen, saleId]);

  const fetchReceiptData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/sales/${saleId}/receipt`);

      if (response.data.success) {
        setReceiptData(response.data.data.receipt);
      } else {
        setError('Failed to load receipt');
      }
    } catch (err) {
      console.error('Error fetching receipt:', err);
      setError(err.response?.data?.error?.message || 'Failed to load receipt');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      console.log('Starting PDF generation...');
      const receiptElement = document.getElementById('receipt-content');

      if (!receiptElement) {
        console.error('Receipt element not found!');
        alert('Receipt element not found. Please try again.');
        return;
      }

      // Clone the receipt element to avoid modifying the original
      const clone = receiptElement.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.width = receiptElement.offsetWidth + 'px';

      // Add pdf-mode class to force standard colors (no oklch)
      clone.classList.add('pdf-mode');

      document.body.appendChild(clone);

      // Wait a moment for styles to apply
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('Creating canvas from receipt...');
      // Create canvas from cloned receipt HTML
      const canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      // Remove clone from DOM
      document.body.removeChild(clone);

      console.log('Canvas created:', canvas.width, 'x', canvas.height);

      // Calculate PDF dimensions for 80mm thermal receipt
      const imgWidth = 80; // 80mm width for thermal printer
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      console.log('Creating PDF...', imgWidth, 'x', imgHeight);

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [imgWidth, imgHeight]
      });

      // Add image to PDF
      const imgData = canvas.toDataURL('image/png');
      console.log('Adding image to PDF...');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // Generate filename
      const filename = `receipt-${receiptData?.receipt_number || saleId}-${new Date().toISOString().split('T')[0]}.pdf`;
      console.log('Saving PDF as:', filename);

      // Download PDF
      pdf.save(filename);
      console.log('PDF download initiated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      console.error('Error details:', error.message, error.stack);
      alert(`Failed to generate PDF: ${error.message}. Please try printing instead.`);
    }
  };

  const handleClose = () => {
    setReceiptData(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 no-print"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header - Hide on print */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center no-print">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Receipt
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading receipt...</p>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <div className="text-red-600 dark:text-red-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error</p>
                <p className="text-gray-600 dark:text-gray-400">{error}</p>
                <button
                  onClick={fetchReceiptData}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && receiptData && (
              <Receipt receiptData={receiptData} />
            )}
          </div>

          {/* Footer - Hide on print */}
          {!loading && !error && receiptData && (
            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end space-x-3 no-print">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download PDF</span>
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print Receipt</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ReceiptModal;
