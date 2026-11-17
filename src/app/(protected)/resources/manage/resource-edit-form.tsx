"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { updateResourceDetails } from "../actions";

type ResourceEditFormProps = {
  resourceId: string;
  name: string;
  description: string;
};

export default function ResourceEditForm({ resourceId, name, description }: ResourceEditFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const formId = `resource-edit-form-${resourceId}`;
  const formRef = useRef<HTMLFormElement>(null);

  function toggleEditor() {
    if (isEditing) formRef.current?.reset();
    setIsEditing(!isEditing);
  }

  function cancelEditor() {
    formRef.current?.reset();
    setIsEditing(false);
  }

  return (
    <div className="resource-editable-details">
      <div className="resource-edit-heading">
        {!isEditing && <h3>{name}</h3>}
        <button
          className="resource-edit-icon-button"
          type="button"
          aria-label={isEditing ? `Fechar edição de ${name}` : `Editar nome e descrição de ${name}`}
          aria-expanded={isEditing}
          aria-controls={formId}
          title={isEditing ? "Fechar edição" : `Editar ${name}`}
          onClick={toggleEditor}
        >
          <span aria-hidden="true">
            {isEditing ? "×" : <Pencil size={16} strokeWidth={1.8} />}
          </span>
        </button>
      </div>
      {!isEditing && <p>{description}</p>}
      <form
        ref={formRef}
        id={formId}
        className="resource-edit-form"
        action={updateResourceDetails}
        hidden={!isEditing}
      >
        <input type="hidden" name="resourceId" value={resourceId} />
        <label htmlFor={`${formId}-name`}>
          Nome
          <input
            id={`${formId}-name`}
            name="name"
            minLength={2}
            maxLength={100}
            defaultValue={name}
            required
          />
        </label>
        <label htmlFor={`${formId}-description`}>
          Descrição
          <textarea
            id={`${formId}-description`}
            name="description"
            minLength={2}
            maxLength={1000}
            defaultValue={description}
            required
          />
        </label>
        <div className="resource-edit-actions">
          <button type="submit">Salvar alterações</button>
          <button className="resource-edit-cancel" type="button" onClick={cancelEditor}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}