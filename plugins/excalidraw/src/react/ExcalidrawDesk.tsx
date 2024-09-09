import React from 'react';
import { ReactNode } from 'react';
// import { render } from 'react-dom';
 import { Excalidraw } from '@excalidraw/excalidraw';
// <Excalidraw excalidrawAPI={(api)=> this.props.excalidrawAPI(api)} />

import {
  ExcalidrawImperativeAPI
} from '@excalidraw/excalidraw/types/types';


type DeskState = {
  nop: any
};

export type DeskParams = {
  excalidrawAPI: ExcalidrawImperativeAPI | null
}



export class ExcalidrawDesk extends React.Component<DeskParams, DeskState> {
  constructor(props: DeskParams) {
    super(props);
    this.state = {
      nop: null
    };
  }  
  render():any {

      return (
        <> {
        }
        </>
      );
  }
}
