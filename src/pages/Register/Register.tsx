import React, { useState, useEffect } from 'react';
import { showToast } from '../../components/Toast';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, User, MapPin, Wallet, GraduationCap } from 'lucide-react';
import { DIMENSIONS } from '../../data/dimensions';
import { Respondent } from '../../types/types';

const QUESTIONS = [
  { key: 'gender', label: '性别', icon: User, type: 'radio', options: [
    { label: '男', value: 'male' },
    { label: '女', value: 'female' },
  ]},
  { key: 'age', label: '年龄', icon: User, type: 'select', options: DIMENSIONS.find(d => d.key === 'age')?.tags || [] },
  { key: 'region', label: '所在地区', icon: MapPin, type: 'select', options: DIMENSIONS.find(d => d.key === 'region')?.tags || [] },
  { key: 'income', label: '个人月收入', icon: Wallet, type: 'select', options: DIMENSIONS.find(d => d.key === 'income')?.tags || [] },
  { key: 'education', label: '教育程度', icon: GraduationCap, type: 'select', options: DIMENSIONS.find(d => d.key === 'education')?.tags || [] },
];

export default function Register() {
  const [searchParams] = useSearchParams();
  const [openid, setOpenid] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const oid = searchParams.get('openid');
    if (oid) {
      setOpenid(oid);
    }
  }, [searchParams]);

  const currentQuestion = QUESTIONS[currentStep];
  const Icon = currentQuestion?.icon || User;

  const handleAnswer = (value: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.key]: value,
    }));
  };

  const canProceed = () => {
    return answers[currentQuestion.key];
  };

  const handleNext = () => {
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!openid) {
      showToast('无法获取用户标识，请从公众号入口进入', 'error');
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('提交数据:', {
      openid,
      ...answers,
    });

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">注册成功！</h2>
          <p className="text-gray-600 mb-6">
            感谢您的注册，您已成为我们的调研合作伙伴。
            有合适的调研项目时，我们会第一时间通知您！
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <div className="text-sm text-gray-500 mb-2">注册信息</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">OpenID:</span>
                <span className="font-mono text-gray-900 truncate ml-2">{openid}</span>
              </div>
              {QUESTIONS.map(q => (
                <div key={q.key} className="flex justify-between">
                  <span className="text-gray-600">{q.label}:</span>
                  <span className="text-gray-900">
                    {q.options.find(o => o.value === answers[q.key])?.['label'] || q.options.find(o => o.value === answers[q.key])?.['name'] || '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">用户注册</h1>
          <p className="text-gray-600 text-sm">请填写以下基本信息完成注册</p>
          {openid && (
            <p className="text-xs text-gray-400 mt-2 font-mono">OpenID: {openid}</p>
          )}
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {QUESTIONS.map((_, index) => (
            <div
              key={index}
              className={`w-8 h-1 rounded-full transition-all ${
                index <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {currentQuestion && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Icon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">问题 {currentStep + 1} / {QUESTIONS.length}</div>
                <div className="text-lg font-bold text-gray-900">{currentQuestion.label}</div>
              </div>
            </div>

            <div className="space-y-3">
              {currentQuestion.type === 'radio' && currentQuestion.options.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(option.value)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center justify-between ${
                    answers[currentQuestion.key] === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium">{option.label}</span>
                  {answers[currentQuestion.key] === option.value && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              ))}

              {currentQuestion.type === 'select' && currentQuestion.options.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(option.value)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    answers[currentQuestion.key] === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium">{option.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-4 mt-8">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              上一步
            </button>
          )}

          {currentStep < QUESTIONS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一步
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="flex-1 py-3 bg-green-600 rounded-lg text-white font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  提交注册
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
