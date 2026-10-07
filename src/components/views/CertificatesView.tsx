import React, { useState } from 'react';
import {
  Award,
  Search,
  Printer,
  CheckCircle2,
  ShieldCheck,
  Eye,
  Sparkles
} from 'lucide-react';
import { CertificateRecord, InstitutionSettings } from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';

interface CertificatesViewProps {
  certificates: CertificateRecord[];
  institutionSettings: InstitutionSettings;
}

export const CertificatesView: React.FC<CertificatesViewProps> = ({
  certificates,
  institutionSettings
}) => {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(
    certificates[0] || null
  );

  const filteredCerts = certificates.filter(
    (c) =>
      c.certificate_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.student_name_ar.includes(searchTerm) ||
      c.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.course_name_ar.includes(searchTerm)
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-arabic-heading text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-emerald-800" />
            <span>{t.certificatesHubTitle}</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {t.certificatesHubDesc}
          </p>
        </div>

        {/* Search input */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchCertificatePlaceholder}
            className="w-full pl-3 pr-9 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:border-emerald-700 outline-hidden shadow-2xs"
          />
          <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Certificates Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
        {filteredCerts.map((cert) => (
          <div
            key={cert.id}
            className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-2xs hover:border-emerald-700/50 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                  {cert.certificate_no}
                </span>
                <span className="text-xs text-stone-400 font-medium">
                  {cert.issued_at}
                </span>
              </div>

              <h4 className="font-arabic-heading text-base font-bold text-stone-900">
                {cert.student_name_ar}
              </h4>
              <p className="text-xs text-stone-600 mt-1 font-medium">
                {cert.course_name_ar}
              </p>

              <div className="mt-3 p-2.5 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-500">{t.generalGradeLabel}</span>
                <span className="font-bold text-emerald-900">{cert.grade_band_ar}</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-stone-100 flex items-center gap-2">
              <button
                onClick={() => setPreviewCert(cert)}
                className="flex-1 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                <span>{t.previewCertificateBtn}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* High Fidelity Authentic Certificate Document Card */}
      {previewCert && (
        <div className="bg-white rounded-3xl border border-stone-300 shadow-xl overflow-hidden mt-6">
          {/* Certificate Action Top Bar */}
          <div className="p-4 bg-stone-900 text-white flex items-center justify-between no-print">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold">
                {t.officialCertTitle} ({t.certNumberLabel} {previewCert.certificate_no})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>{t.printOrSavePdfBtn}</span>
              </button>
            </div>
          </div>

          {/* Printable Islamic Certificate Sheet with Uploaded Logo & Signature */}
          <div className="p-6 sm:p-12 bg-radial from-[#fffdfa] to-[#fbf7ee] text-stone-900 border-8 border-double border-emerald-900/40 m-4 sm:m-8 rounded-2xl relative shadow-inner">
            {/* Corner Decorative Ornaments */}
            <div className="absolute top-3 right-3 text-emerald-900/30 text-2xl font-serif">❖</div>
            <div className="absolute top-3 left-3 text-emerald-900/30 text-2xl font-serif">❖</div>
            <div className="absolute bottom-3 right-3 text-emerald-900/30 text-2xl font-serif">❖</div>
            <div className="absolute bottom-3 left-3 text-emerald-900/30 text-2xl font-serif">❖</div>

            {/* Header: Logo & Institution Name */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-24 h-24 rounded-full flex items-center justify-center p-1 border-2 border-amber-400 shadow-xs bg-white">
                {institutionSettings.logo_data_url ? (
                  <img
                    src={institutionSettings.logo_data_url}
                    alt="Institution Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Award className="w-16 h-16 text-emerald-900" />
                )}
              </div>

              <div className="font-arabic-heading text-sm text-stone-600">
                {t.bismillah}
              </div>

              <h1 className="font-arabic-heading text-2xl sm:text-3xl font-bold text-emerald-950 tracking-tight">
                {institutionSettings.name_en}
              </h1>
              <div className="text-xs text-amber-800 font-bold font-arabic-heading tracking-wide">
                {institutionSettings.name_ar}
              </div>

              {/* Rhythmic Motto on Certificate */}
              <div className="text-[11px] text-stone-500 italic max-w-md pt-0.5">
                "{t.sloganRhyme}"
              </div>

              <div className="w-32 h-[2px] bg-linear-to-r from-transparent via-amber-600 to-transparent my-1" />

              <h2 className="font-arabic-heading text-xl sm:text-2xl font-bold text-amber-800 pt-1">
                {t.certificatePassHeading}
              </h2>
            </div>

            {/* Certificate Body Text */}
            <div className="max-w-2xl mx-auto my-8 text-center space-y-4">
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                {institutionSettings.default_wording_ar}
              </p>

              <div className="py-2">
                <span className="text-xs text-stone-500 block mb-1">{t.studentNamePrefix}</span>
                <span className="font-arabic-heading text-2xl sm:text-3xl font-bold text-emerald-900 underline decoration-amber-400 decoration-2 underline-offset-8">
                  {previewCert.student_name_ar}
                </span>
                <span className="text-xs text-stone-400 block mt-2 font-serif">
                  {previewCert.student_name}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                {language === 'ha'
                  ? `Ya kammala darussan fannin: `
                  : language === 'en'
                  ? `Has successfully satisfied all curricular requirements for: `
                  : `قد أتم بنجاح متطلبات دراسة مقرر: `}
                <strong className="text-stone-900 font-bold">{previewCert.course_name_ar}</strong>{' '}
                {language === 'ha'
                  ? `kuma ya sami matakin: `
                  : language === 'en'
                  ? `and achieved the honor band: `
                  : `وحصل على تقدير: `}
                <strong className="text-emerald-900 font-bold">{previewCert.grade_band_ar}</strong>{' '}
                ({previewCert.final_score}%).
              </p>
            </div>

            {/* Certificate Footer: QR Code, Certificate Number, and Signatory Upload */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-stone-300/80 mt-8">
              {/* QR Verification Code */}
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-white p-1.5 border border-stone-300 rounded-xl flex items-center justify-center shadow-xs shrink-0">
                  <svg className="w-full h-full text-stone-800" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14-2h4v2h-4v-2zm-4 0h2v4h-2v-4zm2 2h2v4h-2v-4zm2 2h2v4h-2v-4zm-4 2h2v2h-2v-2z" />
                  </svg>
                </div>
                <div className="text-left text-[11px] text-stone-500">
                  <div className="font-bold text-stone-800">
                    {t.certNumberLabel} {previewCert.certificate_no}
                  </div>
                  <div>{t.issueDateLabel} {previewCert.issued_at}</div>
                  <div className="text-emerald-800 font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> {t.verifiedOfficialBadge}
                  </div>
                </div>
              </div>

              {/* Dean Signature Upload Area */}
              <div className="text-center sm:text-right flex flex-col items-center sm:items-end">
                <span className="text-xs font-bold text-stone-800 block">
                  {institutionSettings.signatory_title_ar}
                </span>

                <div className="h-16 w-40 flex items-center justify-center my-1">
                  {institutionSettings.signature_data_url ? (
                    <img
                      src={institutionSettings.signature_data_url}
                      alt="Dean Signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="font-arabic-heading text-lg text-emerald-900 italic font-bold">
                      Musa Aminu Muhammad
                    </span>
                  )}
                </div>

                <span className="text-xs font-bold text-emerald-950 font-arabic-heading">
                  {institutionSettings.signatory_name_ar}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
