import { Context } from 'overmind';
import * as Comlink from 'comlink';
import {
  PossibleRequest,
  Tag,
  ValidationResponse,
  ValidationNodeTarget,
  ValidationNodeElement,
  TagRequest,
} from 'cwrc-worker-validator';

export const workerLoadSchema = async ({ state }: Context) => {
  if (!state.validator.hasValidator) return;

  const workerValidator = window.workerValidator;

  const id: string = window.writer.schemaManager.getCurrentSchema().id;
  const url: string = window.writer.schemaManager.getXMLUrl();
  const localData = localStorage.getItem(`schema_${id}`) ?? undefined;

  const { status, remoteData } = await workerValidator.loadSchema({ id, localData, url });
  console.log(status);

  if (remoteData) {
    localStorage.setItem(`schema_${id}`, JSON.stringify(remoteData));
    console.log('Schema cached.');
  }
};

export const workerValidate = async ({ state }: Context) => {
  if (!state.validator.hasValidator) return;

  const workerValidator = window.workerValidator;
  const documentString = await window.writer.converter.getDocumentContent(false);

  const validationProgress = ({ partDone, state, valid, errors }: ValidationResponse) => {
    if (state <= 2) {
      window.writer.event('documentValidating').publish(partDone);
      return;
    }

    window.writer.event('documentValidated').publish(valid, { valid, errors }, documentString);
  };

  workerValidator.validate(documentString, Comlink.proxy(validationProgress));
};

export const workerGetPossibleFromError = async (
  { state }: Context,
  {
    type,
    target,
    element,
  }: { type: string; target: ValidationNodeTarget; element: ValidationNodeElement }
) => {
  if (!state.validator.hasValidator) return;
  const workerValidator = window.workerValidator;

  let xpath = target.xpath;
  let index = target.index;

  if (type === 'ElementNameError') xpath = element.xpath;

  if (type === 'AttributeNameError') {
    xpath = element.parentElementXpath;
    index = element.parentElementIndex;
  }

  if (type === 'ValidationError') {
    xpath = element.xpath;
    //@ts-ignore
    index = element.index;
  }

  //@ts-ignore
  const response = await workerValidator.validatePossible(xpath, index, type);
  return response;
};

export const workerPossibleAtContextMenu = async ({ state }: Context, params: PossibleRequest) => {
  if (!state.validator.hasValidator) return;
  const workerValidator = window.workerValidator;

  const response = await workerValidator.possibleAtContextMenu(params);
  const tags: Tag[] = response.tags.speculative || response.tags.possible;
  return tags;
};

export const workerTagAt = async ({ state }: Context, params: TagRequest) => {
  if (!state.validator.hasValidator) return;
  const workerValidator = window.workerValidator;

  const tag = await workerValidator.tagAt(params);
  return tag;
}

export const workerAttributesForTag = async ({ state }: Context, xpath: string) => {
  if (!state.validator.hasValidator) return;
  const workerValidator = window.workerValidator;

  const tagAttributes = await workerValidator.attributesForTag(xpath);
  return tagAttributes;
}
