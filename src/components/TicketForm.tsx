
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { translateCategory, getCategoriesByRole, UserRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';

const TicketForm: React.FC = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const categories = user ? getCategoriesByRole(user.role as UserRole) : [];
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !description || !category) {
      toast.error('Por favor complete todos los campos requeridos');
      return;
    }
    
    if (!user) {
      toast.error('Debe iniciar sesión para crear un ticket');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // The database assigns the ticket number (TK-0001, TK-0002, ...).
      const { error } = await supabase
        .from('tickets')
        .insert([
          {
            title,
            description,
            category,
            creator_id: user.id,
            status: 'nuevo',
            priority: 'media', // Default priority
          }
        ]);
        
      if (error) {
        throw error;
      }
      
      toast.success('Ticket creado exitosamente');
      
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('');
      setLocation('');
      setCurrentStep(1);
    } catch (error) {
      toast.error('Error al crear el ticket');
      console.error('Error creating ticket:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const nextStep = () => {
    if (currentStep === 1 && (!title || !category)) {
      toast.error('Por favor complete todos los campos requeridos antes de continuar');
      return;
    }
    setCurrentStep(currentStep + 1);
  };
  
  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };
  
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={category || undefined} onValueChange={setCategory}>
                  <SelectTrigger id="category" aria-label="Seleccionar categoría">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {translateCategory(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="title">Título breve</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Describa brevemente su problema"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Ubicación (opcional)</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Campus/Edificio/Aula"
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <Button 
                onClick={nextStep} 
                className="bg-unison-blue hover:bg-blue-700"
              >
                Siguiente
              </Button>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descripción detallada</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describa detalladamente el problema que está experimentando"
                  required
                  rows={8}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Adjuntos (opcional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
                  <div className="flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600">
                      Arrastre archivos aquí o <span className="text-unison-blue">explore</span>
                    </p>
                    <input type="file" className="hidden" multiple />
                    <p className="text-xs text-gray-500 mt-1">Máximo 3 archivos (PNG, JPG, PDF, DOC, hasta 5MB)</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between mt-6">
              <Button 
                onClick={prevStep}
                variant="outline"
              >
                Anterior
              </Button>
              <Button 
                type="submit" 
                className="bg-unison-yellow text-black hover:bg-amber-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Reporte'}
              </Button>
            </div>
          </>
        );
      default:
        return null;
    }
  };
  
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-2">
        <CardTitle>Reportar Incidencia</CardTitle>
        <CardDescription>
          Complete el formulario para reportar un problema técnico
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center">
                <div className={`rounded-full h-8 w-8 flex items-center justify-center ${currentStep === 1 ? 'bg-unison-blue text-white' : 'bg-gray-200'}`}>
                  1
                </div>
                <span className="text-xs mt-1">Información</span>
              </div>
              <div className="flex-1 h-1 mx-2 bg-gray-200">
                <div className={`h-full ${currentStep === 2 ? 'bg-unison-blue' : 'bg-gray-200'}`} style={{ width: `${currentStep > 1 ? '100%' : '0%'}` }}></div>
              </div>
              <div className="flex flex-col items-center">
                <div className={`rounded-full h-8 w-8 flex items-center justify-center ${currentStep === 2 ? 'bg-unison-blue text-white' : 'bg-gray-200'}`}>
                  2
                </div>
                <span className="text-xs mt-1">Detalles</span>
              </div>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          {renderStepContent()}
        </form>
      </CardContent>
    </Card>
  );
};

export default TicketForm;
