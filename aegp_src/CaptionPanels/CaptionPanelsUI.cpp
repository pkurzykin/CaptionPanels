/*******************************************************************/
/*                                                                 */
/*                      ADOBE CONFIDENTIAL                         */
/*                   _ _ _ _ _ _ _ _ _ _ _ _ _                     */
/*                                                                 */
/* Copyright 2007-2023 Adobe Inc.                                  */
/* All Rights Reserved.                                            */
/*                                                                 */
/* NOTICE:  All information contained herein is, and remains the   */
/* property of Adobe Inc. and its suppliers, if                    */
/* any.  The intellectual and technical concepts contained         */
/* herein are proprietary to Adobe Inc. and its                    */
/* suppliers and may be covered by U.S. and Foreign Patents,       */
/* patents in process, and are protected by trade secret or        */
/* copyright law.  Dissemination of this information or            */
/* reproduction of this material is strictly forbidden unless      */
/* prior written permission is obtained from Adobe Inc.            */
/* Incorporated.                                                   */
/*                                                                 */
/*******************************************************************/

#include "CaptionPanels.h"
#include "CaptionPanelsUI.h"
#include <algorithm>

#undef min

CaptionPanelsUI::CaptionPanelsUI(SPBasicSuite* spbP, AEGP_PanelH panelH,
								AEGP_PlatformViewRef platformWindowRef,
					   AEGP_PanelFunctions1* outFunctionTable)
					   : i_refH(platformWindowRef), i_panelH(panelH),
					   red(255), green(255), blue(255), i_use_bg(false),
					   i_appSuite(spbP, kPFAppSuite, kPFAppSuiteVersion4), 
					   i_panelSuite(spbP, kAEGPPanelSuite, kAEGPPanelSuiteVersion1), 
					   i_numClicks(0)

{
	outFunctionTable->DoFlyoutCommand = S_DoFlyoutCommand;
	outFunctionTable->GetSnapSizes = S_GetSnapSizes;
	outFunctionTable->PopulateFlyout = S_PopulateFlyout;
}


void CaptionPanelsUI::GetSnapSizes(A_LPoint*	snapSizes, A_long * numSizesP)
{
	snapSizes[0].x = 400;
	snapSizes[0].y = 600;
	snapSizes[1].x = 350;
	snapSizes[1].y = 500;
	*numSizesP = 2;
}

void 	CaptionPanelsUI::PopulateFlyout(AEGP_FlyoutMenuItem* itemsP, A_long * in_out_numItemsP)
{
	*in_out_numItemsP = 0;
}

void	CaptionPanelsUI::DoFlyoutCommand(AEGP_FlyoutMenuCmdID commandID)
{
	(void)commandID;
}

A_Err	CaptionPanelsUI::S_GetSnapSizes(AEGP_PanelRefcon refcon, A_LPoint*	snapSizes, A_long * numSizesP)
{
	PT_XTE_START{
		reinterpret_cast<CaptionPanelsUI*>(refcon)->GetSnapSizes(snapSizes, numSizesP);
	} PT_XTE_CATCH_RETURN_ERR;
}

A_Err	CaptionPanelsUI::S_PopulateFlyout(AEGP_PanelRefcon refcon, AEGP_FlyoutMenuItem* itemsP, A_long * in_out_numItemsP)
{
	PT_XTE_START{
		reinterpret_cast<CaptionPanelsUI*>(refcon)->PopulateFlyout(itemsP, in_out_numItemsP);
	} PT_XTE_CATCH_RETURN_ERR;
}

A_Err	CaptionPanelsUI::S_DoFlyoutCommand(AEGP_PanelRefcon refcon, AEGP_FlyoutMenuCmdID commandID)
{
	PT_XTE_START{
		reinterpret_cast<CaptionPanelsUI*>(refcon)->DoFlyoutCommand(commandID);
	} PT_XTE_CATCH_RETURN_ERR;
}
